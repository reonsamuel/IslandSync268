# Security Specification for Island Sync

## 1. Data Invariants
- **Driver Ownership**: A driver document must be owned by the user whose UID matches the document ID.
- **Valid Coordinates**: Latitude must be between -90 and 90. Longitude must be between -180 and 180.
- **Status Integrity**: Status must be strictly one of `IN_TRANSIT`, `DELIVERED`, or `DELAYED`.
- **System Integrity**: Drivers cannot modify their own ID or immutable fields like `createdAt` (if added).
- **Relational Integrity**: Cargo items must belong to a valid driver document.

## 2. The Dirty Dozen Payloads
1. **Identity Spoofing**: User A attempts to update User B's latitude.
2. **Status Poisoning**: User attempts to set status to `GHOST_MODE`.
3. **Resource Exhaustion**: User attempts to set a 1MB string in the `name` field.
4. **Coordinate Poisoning**: Latitude set to `999`.
5. **Quantity Poisoning**: Cargo quantity set to `-10`.
6. **Orphaned Cargo**: Attempting to create cargo for a non-existent driver.
7. **Bypassing Online Requirement**: Attempting to update location while `isOnline` is false (if logic enforced).
8. **Shadow Field Injection**: Adding an `isAdmin: true` field to the driver profile.
9. **Signature Forgery**: User A signing for a delivery they didn't make.
10. **Timestamp Manual Override**: Manually setting `lastUpdate` to a future date.
11. **Mass List Scraping**: Attempting to list all cargo for all drivers without being a merchant.
12. **Unauthorized Deletion**: A driver trying to delete another driver's cargo manifest.
