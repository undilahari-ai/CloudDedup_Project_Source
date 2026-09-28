import React, { FormEvent, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc
} from "firebase/firestore";

import { auth, db } from "./firebase";
import {
  SIMILARITY_THRESHOLD,
  normalize,
  recordSimilarity,
  sha256
} from "./dedup";
import "./style.css";

type RecordItem = {
  id: string;
  title: string;
  description: string;
  normalizedTitle: string;
  normalizedDescription: string;
  contentHash: string;
  status: "UNIQUE" | "FALSE_POSITIVE";
  isVerified: true;
};

type ReviewItem = {
  id: string;
  title: string;
  description: string;
  normalizedTitle: string;
  normalizedDescription: string;
  contentHash: string;
  similarityScore: number;
  matchedRecordId: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
};

type DuplicateEvent = {
  id: string;
  kind: "EXACT_DUPLICATE" | "CONFIRMED_DUPLICATE";
};

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginMode, setLoginMode] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [stats, setStats] = useState({
    unique: 0,
    falsePositives: 0,
    pending: 0,
    blockedDuplicates: 0
  });

  useEffect(() => {
    return onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser) await refreshAll(currentUser.uid);
    });
  }, []);

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setMessage("");

      if (loginMode) {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        const credential = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );

        if (name.trim()) {
          await updateProfile(credential.user, { displayName: name.trim() });
        }
      }
    } catch (error: unknown) {
      setMessage(errorMessage(error, "Authentication failed."));
    }
  }

  async function refreshAll(uid = user?.uid) {
    if (!uid) return;

    try {
      const [recordsSnapshot, reviewsSnapshot, eventsSnapshot] =
        await Promise.all([
          getDocs(collection(db, "users", uid, "records")),
          getDocs(collection(db, "users", uid, "reviewQueue")),
          getDocs(collection(db, "users", uid, "duplicateEvents"))
        ]);

      const recordData = recordsSnapshot.docs.map((snapshot) => ({
        id: snapshot.id,
        ...snapshot.data()
      })) as RecordItem[];

      const reviewData = reviewsSnapshot.docs.map((snapshot) => ({
        id: snapshot.id,
        ...snapshot.data()
      })) as ReviewItem[];

      const duplicateEvents = eventsSnapshot.docs.map((snapshot) => ({
        id: snapshot.id,
        ...snapshot.data()
      })) as DuplicateEvent[];

      setRecords(recordData);
      setReviews(reviewData.filter((item) => item.status === "PENDING"));

      setStats({
        unique: recordData.filter((item) => item.status === "UNIQUE").length,
        falsePositives: recordData.filter(
          (item) => item.status === "FALSE_POSITIVE"
        ).length,
        pending: reviewData.filter((item) => item.status === "PENDING").length,
        blockedDuplicates: duplicateEvents.length
      });
    } catch (error: unknown) {
      setMessage(errorMessage(error, "Unable to refresh dashboard."));
    }
  }

  async function logDuplicateEvent(
    uid: string,
    kind: DuplicateEvent["kind"],
    contentHash: string,
    matchedRecordId: string,
    sourceReviewId: string | null
  ) {
    const eventReference = doc(
      collection(db, "users", uid, "duplicateEvents")
    );

    await setDoc(eventReference, {
      kind,
      contentHash,
      matchedRecordId,
      sourceReviewId,
      createdAt: serverTimestamp()
    });
  }

  async function submitRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;

    if (!title.trim() || !description.trim()) {
      setMessage("Title and description are required.");
      return;
    }

    setMessage("Checking record...");

    const normalizedTitle = normalize(title);
    const normalizedDescription = normalize(description);
    const contentHash = await sha256(
      `${normalizedTitle}|${normalizedDescription}`
    );

    const hashReference = doc(
      db,
      "users",
      user.uid,
      "hashes",
      contentHash
    );
    const pendingHashReference = doc(
      db,
      "users",
      user.uid,
      "pendingHashes",
      contentHash
    );

    try {
      const [existingHash, existingPendingHash] = await Promise.all([
        getDoc(hashReference),
        getDoc(pendingHashReference)
      ]);

      if (existingHash.exists()) {
        await logDuplicateEvent(
          user.uid,
          "EXACT_DUPLICATE",
          contentHash,
          String(existingHash.data().recordId ?? "unknown"),
          null
        );
        setMessage("Exact duplicate blocked.");
        await refreshAll();
        return;
      }

      if (existingPendingHash.exists()) {
        setMessage("This record is already waiting for review.");
        return;
      }

      const recordsSnapshot = await getDocs(
        collection(db, "users", user.uid, "records")
      );

      let bestRecord: RecordItem | null = null;
      let bestScore = 0;

      for (const snapshot of recordsSnapshot.docs) {
        const item = { id: snapshot.id, ...snapshot.data() } as RecordItem;
        const score = recordSimilarity(
          normalizedTitle,
          normalizedDescription,
          item.normalizedTitle,
          item.normalizedDescription
        );

        if (score > bestScore) {
          bestScore = score;
          bestRecord = item;
        }
      }

      if (bestRecord && bestScore >= SIMILARITY_THRESHOLD) {
        const reviewReference = doc(
          collection(db, "users", user.uid, "reviewQueue")
        );

        try {
          await runTransaction(db, async (transaction) => {
            const [currentHash, currentPendingHash] = await Promise.all([
              transaction.get(hashReference),
              transaction.get(pendingHashReference)
            ]);

            if (currentHash.exists()) {
              throw new Error("Exact duplicate blocked.");
            }
            if (currentPendingHash.exists()) {
              throw new Error("This record is already waiting for review.");
            }

            transaction.set(pendingHashReference, {
              reviewId: reviewReference.id,
              createdAt: serverTimestamp()
            });
            transaction.set(reviewReference, {
              title: title.trim(),
              description: description.trim(),
              normalizedTitle,
              normalizedDescription,
              contentHash,
              matchedRecordId: bestRecord!.id,
              similarityScore: bestScore,
              status: "PENDING",
              createdAt: serverTimestamp()
            });
          });
        } catch (error: unknown) {
          const reason = errorMessage(error, "Unable to queue review.");
          if (reason === "Exact duplicate blocked.") {
            const latestHash = await getDoc(hashReference);
            if (latestHash.exists()) {
              await logDuplicateEvent(
                user.uid,
                "EXACT_DUPLICATE",
                contentHash,
                String(latestHash.data().recordId ?? "unknown"),
                null
              );
            }
          }
          throw error;
        }

        setMessage(
          `Possible duplicate detected (${(bestScore * 100).toFixed(
            1
          )}%). Sent to review queue.`
        );
        setTitle("");
        setDescription("");
        await refreshAll();
        return;
      }

      try {
        await runTransaction(db, async (transaction) => {
          const currentHash = await transaction.get(hashReference);
          if (currentHash.exists()) throw new Error("Exact duplicate blocked.");

          const recordReference = doc(
            collection(db, "users", user.uid, "records")
          );

          transaction.set(hashReference, {
            recordId: recordReference.id,
            createdAt: serverTimestamp()
          });
          transaction.set(recordReference, {
            title: title.trim(),
            description: description.trim(),
            normalizedTitle,
            normalizedDescription,
            contentHash,
            status: "UNIQUE",
            isVerified: true,
            createdAt: serverTimestamp()
          });
        });
      } catch (error: unknown) {
        const reason = errorMessage(error, "Unable to save record.");
        if (reason === "Exact duplicate blocked.") {
          const latestHash = await getDoc(hashReference);
          if (latestHash.exists()) {
            await logDuplicateEvent(
              user.uid,
              "EXACT_DUPLICATE",
              contentHash,
              String(latestHash.data().recordId ?? "unknown"),
              null
            );
          }
        }
        throw error;
      }

      setMessage("Unique record verified and stored.");
      setTitle("");
      setDescription("");
      await refreshAll();
    } catch (error: unknown) {
      setMessage(errorMessage(error, "Unable to validate record."));
      await refreshAll();
    }
  }

  async function approveReview(item: ReviewItem) {
    if (!user) return;

    try {
      await runTransaction(db, async (transaction) => {
        const hashReference = doc(
          db,
          "users",
          user.uid,
          "hashes",
          item.contentHash
        );
        const pendingHashReference = doc(
          db,
          "users",
          user.uid,
          "pendingHashes",
          item.contentHash
        );
        const reviewReference = doc(
          db,
          "users",
          user.uid,
          "reviewQueue",
          item.id
        );
        const hashSnapshot = await transaction.get(hashReference);

        if (hashSnapshot.exists()) {
          throw new Error("An exact duplicate already exists.");
        }

        const recordReference = doc(
          collection(db, "users", user.uid, "records")
        );

        transaction.set(hashReference, {
          recordId: recordReference.id,
          createdAt: serverTimestamp()
        });
        transaction.set(recordReference, {
          title: item.title,
          description: item.description,
          normalizedTitle: item.normalizedTitle,
          normalizedDescription: item.normalizedDescription,
          contentHash: item.contentHash,
          status: "FALSE_POSITIVE",
          isVerified: true,
          createdAt: serverTimestamp()
        });
        transaction.update(reviewReference, {
          status: "APPROVED",
          reviewedAt: serverTimestamp()
        });
        transaction.delete(pendingHashReference);
      });

      setMessage("False positive approved and stored.");
      await refreshAll();
    } catch (error: unknown) {
      setMessage(errorMessage(error, "Review approval failed."));
    }
  }

  async function rejectReview(item: ReviewItem) {
    if (!user) return;

    try {
      const reviewReference = doc(
        db,
        "users",
        user.uid,
        "reviewQueue",
        item.id
      );
      const pendingHashReference = doc(
        db,
        "users",
        user.uid,
        "pendingHashes",
        item.contentHash
      );
      const eventReference = doc(
        collection(db, "users", user.uid, "duplicateEvents")
      );

      await runTransaction(db, async (transaction) => {
        transaction.update(reviewReference, {
          status: "REJECTED",
          reviewedAt: serverTimestamp()
        });
        transaction.delete(pendingHashReference);
        transaction.set(eventReference, {
          kind: "CONFIRMED_DUPLICATE",
          contentHash: item.contentHash,
          matchedRecordId: item.matchedRecordId,
          sourceReviewId: item.id,
          createdAt: serverTimestamp()
        });
      });

      setMessage("Duplicate confirmed and rejected.");
      await refreshAll();
    } catch (error: unknown) {
      setMessage(errorMessage(error, "Review rejection failed."));
    }
  }

  async function logout() {
    await signOut(auth);
  }

  if (loading) {
    return (
      <main>
        <p role="status">Loading CloudDedup...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="auth">
        <section>
          <h1>CloudDedup</h1>
          <p>Cloud Data Redundancy &amp; Validation System</p>

          <form onSubmit={handleAuth}>
            {!loginMode && (
              <>
                <label className="sr-only" htmlFor="full-name">
                  Full name
                </label>
                <input
                  id="full-name"
                  name="name"
                  autoComplete="name"
                  placeholder="Full name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </>
            )}

            <label className="sr-only" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="Email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />

            <label className="sr-only" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={loginMode ? "current-password" : "new-password"}
              placeholder="Password"
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />

            <button type="submit">
              {loginMode ? "Login" : "Create account"}
            </button>
            <button
              type="button"
              className="link"
              onClick={() => {
                setLoginMode(!loginMode);
                setMessage("");
              }}
            >
              {loginMode
                ? "Need an account? Register"
                : "Already have an account? Login"}
            </button>
          </form>

          {message && (
            <p role="status" aria-live="polite">
              {message}
            </p>
          )}
        </section>
      </main>
    );
  }

  return (
    <main>
      <header>
        <div>
          <h1>CloudDedup</h1>
          <p>Validate before storing.</p>
        </div>
        <button type="button" onClick={logout}>
          Logout
        </button>
      </header>

      {message && (
        <div className="card" role="status" aria-live="polite">
          <p>{message}</p>
        </div>
      )}

      <section className="grid">
        <div className="card">
          <h2>Submit record</h2>
          <form onSubmit={submitRecord}>
            <label className="sr-only" htmlFor="record-title">
              Record title
            </label>
            <input
              id="record-title"
              name="record-title"
              placeholder="Title"
              required
              maxLength={255}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />

            <label className="sr-only" htmlFor="record-description">
              Record description
            </label>
            <textarea
              id="record-description"
              name="record-description"
              placeholder="Description"
              required
              maxLength={5000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />

            <button type="submit">Validate &amp; Store</button>
          </form>
        </div>

        <div className="card">
          <h2>Dashboard</h2>
          <button type="button" onClick={() => refreshAll()}>
            Refresh stats
          </button>

          <div className="stats">
            <div>
              <b>{records.length}</b>
              <span>verified records</span>
            </div>
            <div>
              <b>{stats.unique}</b>
              <span>unique</span>
            </div>
            <div>
              <b>{stats.falsePositives}</b>
              <span>false positives</span>
            </div>
            <div>
              <b>{stats.pending}</b>
              <span>pending review</span>
            </div>
            <div>
              <b>{stats.blockedDuplicates}</b>
              <span>blocked duplicates</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h2>Review queue</h2>
          {reviews.length === 0 ? (
            <p>No records waiting for review.</p>
          ) : (
            reviews.map((item) => (
              <div key={item.id} className="review-item">
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <p>Similarity: {(item.similarityScore * 100).toFixed(1)}%</p>
                <button type="button" onClick={() => approveReview(item)}>
                  Approve
                </button>
                <button type="button" onClick={() => rejectReview(item)}>
                  Reject
                </button>
              </div>
            ))
          )}
        </div>

        <div className="card">
          <h2>Verified records</h2>
          {records.length === 0 ? (
            <p>No verified records yet.</p>
          ) : (
            records.map((item) => (
              <div key={item.id} className="record-item">
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <strong>{item.status}</strong>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
