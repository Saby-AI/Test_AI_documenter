/*
Date: 13/10/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
package model;
/**
 * Represents an Address object with details for a specific address.
 * This class encapsulates the properties associated with an address,
 * including its type, lines, and geographical details.
 *
 * Design Considerations:
 * - Uses a static counter to ensure unique address IDs.
 * - Lacks input validation; this will need updating for data integrity.
 *
 * Future Enhancements:
 * - Add validation for address fields.
 * - Implement serialization and deserialization for persistence.
 */
public class Address {
    /** Static counter for generating unique address IDs */
    static int addressCounter = 1;
    /** Unique identifier for the party's address */
    int partyAddressId;
    /** The type of address (e.g., home, work) */
    String addressType;
    /** The first line of the address */
    String addressLine1;
    /** The second line of the address (optional) */
    String addressLine2;
    /** The city for the address */
    String city;
    /** The state for the address */
    String state;
    /** The country for the address */
    String country;
    /** The postal code for the address */
    String postalCode;