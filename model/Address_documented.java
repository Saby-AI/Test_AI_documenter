```java
/*
Date: 07/10/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
/**
 * This class represents an Address entity, which contains all necessary fields
 * to describe a physical address associated with a party.
 * <p>
 * An address contains a unique ID, type, and various fields such as street lines,
 * city, state, country, and postal code to fully specify a location.
 * </p>
 */
package model;
public class Address {
    // Static counter to maintain unique address IDs
    static int addressCounter = 1;
    // Unique identifier for this address
    private int partyAddressId;
    // Type of address (e.g., home, business)
    private String addressType;
    // First line of the address
    private String addressLine1;
    // Second line of the address (optional)
    private String addressLine2;
    // City of the address
    private String city;
    // State or province of the address
    private String state;
    // Country of the address
    private String country;
    // Postal code for mailing purposes
    private String postalCode;
    /**
     * Constructs a new Address object with the specified parameters.
     *
     * @param type the type of address (home, work, etc.)
     * @param line1 the primary address line
     * @param line2 the secondary address line (optional)
     * @param city the city of the address
     * @param state the state or province of the address
     * @param country the country of the address
     * @param postalcode the postal code for the address
     */
    public Address(String type, String line1, String line2, String city, String state, String country, String postalcode) {
        this.partyAddressId = addressCounter++;
        this.addressType = type;
        this.addressLine1 = line1;
        this.addressLine2 = line2;
        this.city = city;
        this.state = state;
        this.country = country;
        this.postalCode = postalcode;
    }
    /**
     * Returns a string representation of the Address object.
     *
     * @return string containing information about the address
     */
    @Override
    public String toString() {
        return "Address { id: " + partyAddressId + ", type: " + addressType +
               ", line1: " + addressLine1 + ", line2: " + addressLine2 +
               ", city: " + city + ", state: " + state +
               ", country: " + country + ", postal: " + postalCode + " }";
    }
}
```