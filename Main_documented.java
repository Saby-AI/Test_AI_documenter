````
/**
 * Date: 08/09/2025
 * User: Agentic_AI_System_Documenter
 * Code Language: Java
 */
import model.Address; // Importing the Address model
import model.Communication; // Importing the Communication model
import model.Party; // Importing the Party model
/**
 * Main class handling the creation of customer and vendor instances.
 */
public class Main { // Corrected class name from 'main' to 'Main'
    /**
     * Main entry point for the application.
     *
     * This method instantiates Party objects for a customer and a vendor,
     * adds associated addresses and communication details, and prints the
     * details of both parties.
     *
     * @param args Command line arguments (not used in this implementation).
     */
    public static void main(String[] args) { // Added space for aesthetics
        // Creating a customer Party instance
        Party c = new Party("Alice Johnson", "Person", "Customer", "Active"); // Corrected missing parenthesis
        // Adding billing and shipping addresses
        c.addAddress(new Address("Bill_To", "123 Billing St", "Suite 100", "New York", "NY", "USA", "10001"));
        c.addAddress(new Address("Ship_To", "456 Shipping Ave", "", "Brooklyn", "NY", "USA", "11201"));
        // Adding communication details for the customer
        c.addCommunication(new Communication("Email", "alice@example.com"));
        c.addCommunication(new Communication("Phone", "+1-555-123-4567"));
        // Printing customer details
        System.out.println(c);
        // Creating a vendor Party instance
        Party v = new Party("Tech Supplies Inc.", "Organization", "Vendor", "Active");
        // Adding billing and shipping addresses for the vendor
        v.addAddress(new Address("Bill_To", "789 Tech Blvd", "", "San Jose", "CA", "USA", "95112"));
        v.addAddress(new Address("Ship_To", "321 Supply Rd", "", "Fremont", "CA", "USA", "94536"));
        // Adding communication details for the vendor
        v.addCommunication(new Communication("Fax", "+1-555-987-6543"));
        v.addCommunication(new Communication("Email", "support@techsupplies.com"));
        // Printing vendor details
        System.out.println(v);
    }
}
````