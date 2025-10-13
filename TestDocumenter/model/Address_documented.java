```java
/*
Date: 13/10/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
/**
 * The Address class represents a postal address for a party.
 * It encapsulates the details of the address including street lines, city, state, country, and postal code.
 * It also maintains a unique identifier for each address.
 */
package model;
public class Address {
    // Static counter to assign unique address ID
    static int addressCounter = 1;
    // Unique identifier for each party address
    private int partyAddressId;
    // Type of address (e.g. home, work)
    private String addressType;
    // Street address lines
    private String addressLine1;
    private String addressLine2;
    // Address locality-related information
    private String city;
    private String state;
    private String country;
    private String postalCode;
    /**
     * Constructor for Address class.
     *
     * @param type        The type of address (e.g. 'home', 'office').
     * @param line1      The primary line of the address.
     * @param line2      The secondary line of the address (can be null).
     * @param city       The city of the address.
     * @param state      The state of the address.
     * @param country    The country of the address.
     * @param postalcode The postal code of the address.
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
     * Returns a string representation of the address.
     *
     * @return A string summarizing the address details.
     */
    public String toString() {
        return "Address{ id:" + partyAddressId + ", type:" + addressType +
               ", line1:" + addressLine1 + ", line2:" + addressLine2 +
               ", city:" + city + ", state:" + state +
               ", country:" + country + ", postal:" + postalCode + "}";
    }
}
```
This documentation comprehensively covers the required analysis of your code. Please feel free to ask for further insights or modifications!