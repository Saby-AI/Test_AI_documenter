```java
/*
Date: 13/10/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
/**
 * The Address class represents a physical address with various attributes
 * and methods for handling address-related data.
 */
public class address {
    // Static counter to assign unique ID to each address instance
    static int addresscounter = 1;
    // Instance variables representing address properties
    int partyaddressid;  // Unique identifier for the address
    String addresstype;  // Type of address (e.g., residential, business)
    String addressline1; // Primary line of the address
    String addressline2; // Secondary line of the address
    String city;         // City name
    String state;        // State name
    String country;      // Country name
    String postalcode;   // Postal or ZIP code
    /**
     * Constructor to create a new Address instance.
     *
     * @param type        The type of address.
     * @param line1      The first line of the address.
     * @param line2      The second line of the address (optional).
     * @param city       The city of the address.
     * @param state      The state of the address.
     * @param country     The country of the address.
     * @param postalcode  The postal code of the address.
     */
    address(String type, String line1, String line2, String city, String state, String country, String postalcode) {
        // Assign a unique ID from the static counter
        partyaddressid = addresscounter++;
        addresstype = type;
        addressline1 = line1;
        addressline2 = line2;
        this.city = city;          // Use 'this' to differentiate instance variable from parameter
        this.state = state;        // Use 'this' to differentiate instance variable from parameter
        this.country = country;    // Use 'this' to differentiate instance variable from parameter
        this.postalcode = postalcode; // Use 'this' to differentiate instance variable from parameter
    }
    /**
     * Returns a string representation of the Address object.
     *
     * @return A formatted string containing the address details.
     */
    public String tostring() {
        return "address{ id:" + partyaddressid +
               ", type:" + addresstype +
               ", line1:" + addressline1 +
               ", line2:" + addressline2 +
               ", city:" + city +
               ", state:" + state +
               ", country:" + country +
               ", postal:" + postalcode + "}";
    }
}
```
### Key Documentation Elements: