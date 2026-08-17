# Security Specification - Police Intelligence Image Database

This document details the security constraints, rules, and threat models for the Police Intelligence Mugshot/Suspect Database.

## 1. Data Invariants and Access Control Model

1. **Self-Registration Constraint**: A newly registered user is placed in a `pending` state by default. They cannot read or write any suspects or other users' profiles.
2. **Bootstrapping Admin**: To handle cold start, if no users exist or a user is the first to register, they can become an `admin` and `approved`. To maintain absolute security, after the first user is created, any subsequent user is `pending` and cannot make themselves `admin` or change their status to `approved`.
3. **Role-Based Access (RBAC)**:
   - **Approved User / Admin**: Can read the `/suspects` collection and write new suspects.
   - **Admin Only**: Can read and write all `/users` profiles to approve or reject pending users.
   - **Self**: Any user can read their own `/users/{userId}` profile, but they CANNOT modify their own `role` or `status` once registered.
4. **Suspect Management**: Only authenticated, approved users (officers or admins) can view suspects and add/edit records.

---

## 2. The "Dirty Dozen" Payloads (Threat Vectors)

1. **Privilege Escalation**: A new user signs up and attempts to set `"role": "admin"` in their profile.
2. **Self-Approval**: A pending user attempts to modify their profile status to `"status": "approved"`.
3. **Unauthorized Suspect Read**: An unauthenticated or pending user attempts to query the list of suspects.
4. **Unauthorized Suspect Write**: A pending user attempts to add a new suspect record.
5. **ID Poisoning on Suspect**: An attacker attempts to create a suspect with an ID that is a 10KB string to bloat the Firestore and exhaust resources.
6. **Malformed Suspect Status**: A user attempts to save a suspect with an invalid state, e.g., `"status": "deleted"`.
7. **Bypassing Missing Required Fields**: A user attempts to write a suspect record without the mandatory `document` or `createdBy` fields.
8. **Spoofing Creation Identity**: A user (UID `userA`) attempts to write a suspect record setting `"createdBy": "userB"` to mask their activity.
9. **Tampering with Admin Records**: A regular user attempts to edit another user's profile to demote an admin.
10. **Admin Bypass via Injection**: An attacker tries to write an ID with special characters (e.g., `../admins/someId`) to bypass path restrictions.
11. **Malicious Image URLs Payload**: An attacker tries to upload 10,000 links inside the `photos` array to trigger server memory overflow.
12. **System Field Injection**: A user attempts to update a suspect's immutable `createdAt` timestamp.

---

## 3. Security Rules Draft

We will implement standard, high-security Firestore rules that enforce these invariants directly in `firestore.rules`.
These rules will enforce the default-deny policy, validate IDs, and verify statuses.
