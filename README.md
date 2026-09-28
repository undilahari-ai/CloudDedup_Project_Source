# CloudDedup – Intelligent Cloud-Based Data Deduplication System

## Project Overview

CloudDedup is a cloud-based data deduplication system developed to identify duplicate records and reduce redundant data storage. It uses content hashing and similarity-based duplicate detection to help users manage their data efficiently.

The application provides a user-friendly web interface with Firebase Authentication and Cloud Firestore for cloud-based data management.

## Live Demo

**Live Website:** https://clouddedup-fb33f.web.app

## Features

* User authentication using Firebase Authentication.
* Cloud-based data storage using Cloud Firestore.
* SHA-256 hashing for exact duplicate detection.
* Similarity-based duplicate detection for identifying potential duplicates.
* Review queue for checking possible duplicate records.
* Dashboard for viewing and managing records.
* User-specific data access with Firestore security rules.
* Responsive web interface.

## Technologies Used

| Technology              | Purpose                                 |
| ----------------------- | --------------------------------------- |
| React                   | Frontend user interface                 |
| TypeScript              | Application development                 |
| Vite                    | Development and production build        |
| Firebase Authentication | User authentication                     |
| Cloud Firestore         | Cloud database                          |
| Firebase Hosting        | Application deployment                  |
| SHA-256                 | Content hashing and duplicate detection |

## System Architecture

1. The user accesses the CloudDedup web application.
2. Firebase Authentication handles user login and registration.
3. User records are stored in Cloud Firestore.
4. The application uses content hashes to identify exact duplicates.
5. Potential duplicates are sent to the review queue for further checking.
6. Users can manage their records through the dashboard.

## Installation and Setup

### Prerequisites

* Node.js and npm
* A Firebase project
* Firebase Authentication and Cloud Firestore enabled

### 1. Clone the repository

```bash
git clone https://github.com/undilahari-ai/CloudDedup_Project_Source.git
```

### 2. Open the project folder

```bash
cd CloudDedup_Project_Source/CodeAlpha_CloudDedup/frontend
```

### 3. Install dependencies

```bash
npm install
```

### 4. Configure Firebase

Update the Firebase configuration in `src/firebase.ts` with your own Firebase project's web configuration.

Enable Email/Password authentication and configure Cloud Firestore security rules in the Firebase Console.

### 5. Start the development server

```bash
npm run dev
```

Open the local URL shown in the terminal.

### 6. Build for production

```bash
npm run build
```

## Deployment

The application is deployed using Firebase Hosting.

**Live URL:** https://clouddedup-fb33f.web.app

## Project Information

* **Project Name:** CloudDedup
* **Project Type:** Cloud Computing / Web Application
* **Organization:** CodeAlpha
* **Developer:** Lahari Undi

## License

This project was developed for educational and project submission purposes.
