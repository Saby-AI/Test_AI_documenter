import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
/*
Date: 05/09/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
/**
 * Main class serves as the entry point of the application.
 * It demonstrates the creation and management of Party instances.
 */
public class Main {
    private static final Logger logger = LoggerFactory.getLogger(Main.class);
    public static void main(String[] args) {
        // Create Party instances
        Party customer = new Party("CustomerName", new Address("123 Street", "City", "State", "Zip"));
        Party vendor = new Party("VendorName", new Address("456 Avenue", "City", "State", "Zip"));
        // Print details of the parties
        logger.info("Customer Details: {}", customer.getDetails());
        logger.info("Vendor Details: {}", vendor.getDetails());
    }
}
/**
 * Class representing a party (either customer or vendor).
 * Attributes include name and address.
 */
class Party {
    private String name;
    private Address address;
    /**
     * Constructor for Party class.
     *
     * @param name   The name of the party.
     * @param address The address of the party.
     */
    public Party(String name, Address address) {
        this.name = name;
        this.address = address;
    }
    /**
     * Method to get party details.
     *
     * @return A string representation of the party's details.
     */
    public String getDetails() {
        StringBuilder details = new StringBuilder();
        details.append("Name: ").append(name).append(", Address: ").append(address.toString());
        return details.toString();
    }
}
/**
 * Class representing an address.
 * Attributes include street, city, state, and zip code.
 */
class Address {
    private String street;
    private String city;
    private String state;
    private String zip;
    /**
     * Default constructor for Address class.
     */
    public Address() {}
    /**
     * Constructor for Address class.
     *
     * @param street The street of the address.
     * @param city The city of the address.
     * @param state The state of the address.
     * @param zip The zip code of the address.
     */
    public Address(String street, String city, String state, String zip) {
        this.street = street;
        this.city = city;
        this.state = state;
        this.zip = zip;
    }
    @Override
    public String toString() {
        return street + ";" + city + ";" + state + ";" + zip;
    }
}