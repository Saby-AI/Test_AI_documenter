import model.Address;
import model.Communication;
import model.Party;
/**
 * Main class for handling party details, including customers and vendors.
 * Serves as the entry point for the application where Party instances are created, populated,
 * and their details printed.
 */
public class Main {
    /**
     * Main method serving as the entry point of the application.
     * @param args Command-line arguments (not used).
     */
    public static void main(String[] args) {
        // Creating a Customer Party instance
        Party c = new Party("Alice Johnson", "Person", "Customer", "Active");
        // Adding billing and shipping addresses for the customer
        c.addAddress(new Address("Bill_To", "123 Billing St", "Suite 100", "New York", "NY", "USA", "10001"));
        c.addAddress(new Address("Ship_To", "456 Shipping Ave", "", "Brooklyn", "NY", "USA", "11201"));
        // Adding communication methods for the customer
        c.addCommunication(new Communication("Email", "alice@example.com"));
        c.addCommunication(new Communication("Phone", "+1-555-123-4567"));
        // Outputting the customer party details to the console
        System.out.println(c); // Missing semicolon corrected
        // Creating a Vendor Party instance
        Party v = new Party("Tech Supplies Inc.", "Organization", "Vendor", "Active");
        // Adding billing and shipping addresses for the vendor
        v.addAddress(new Address("Bill_To", "789 Tech Blvd", "", "San Jose", "CA", "USA", "95112"));
        v.addAddress(new Address("Ship_To", "321 Supply Rd", "", "Fremont", "CA", "USA", "94536"));
        // Adding communication methods for the vendor
        v.addCommunication(new Communication("Fax", "+1-555-987-6543"));
        v.addCommunication(new Communication("Email", "support@techsupplies.com"));
        // Outputting the vendor party details to the console
        System.out.println(v); // Ensured semicolon is included here
    }
}