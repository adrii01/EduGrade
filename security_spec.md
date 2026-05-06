# Security Specification: EduGrade

## Data Invariants
1. A Class must belong to a valid Teacher.
2. A Student must belong to a Class and that Class must belong to the Teacher.
3. An Assessment must belong to a Class.
4. A Grade must belong to a Student and an Assessment, and both must belong to the same Class/Teacher context.
5. Attendance must be tied to a Student and Class.
6. Teachers can only read/write their own data.

## The Dirty Dozen Payloads (Rejection Targets)
1. Creating a Class with another user's `teacherId`.
2. Reading another teacher's Students.
3. Updating a Student's `classId` to a class the teacher doesn't own (though here the teacher owns both, but imagine cross-teacher).
4. Creating a Grade for a Student not in the class.
5. Submitting a Grade > 100 or < 0.
6. Modifying `createdAt` matching.
7. Deleting a Class that has Students (cascade check or just prevention).
8. Listing all Teachers.
9. Injecting a massive string into a Student's name.
10. Creating an Assessment with index > total trimesters.
11. Spoofing `updatedAt` with a non-server timestamp.
12. Accessing data without `email_verified`.

## Test Runner logic will be implemented in `firestore.rules.test.ts`.
