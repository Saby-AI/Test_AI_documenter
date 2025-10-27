import model.Address;
import model.Communication;
import model.Party;
/**
 * Main class for demonstrating Party object creation and management.
 */
public class Main {
    /**
     * Main entry point of the application.
     * Creates sample Party and Vendor objects and prints their details.
     * @param args command line arguments
     */
    public static void main(String[] args) {
        // Create a Customer Party
        Party c = new Party("Alice Johnson", "Person", "Customer", "Active");
        c.addAddress(new Address("Bill_To", "123 Billing St", "Suite 100", "New York", "NY", "USA", "10001"));
        c.addAddress(new Address("Ship_To", "456 Shipping Ave", "", "Brooklyn", "NY", "USA", "11201"));
        c.addCommunication(new Communication("Email", "alice@example.com"));
        c.addCommunication(new Communication("Phone", "+1-555-123-4567"));
        System.out.println(c);
        // Create a Vendor Party
        Party v = new Party("Tech Supplies Inc.", "Organization", "Vendor", "Active");
        v.addAddress(new Address("Bill_To", "789 Tech Blvd", "", "San Jose", "CA", "USA", "95112"));
        v.addAddress(new Address("Ship_To", "321 Supply Rd", "", "Fremont", "CA", "USA", "94536"));
        v.addCommunication(new Communication("Fax", "+1-555-987-6543"));
        v.addCommunication(new Communication("Email", "support@techsupplies.com"));
        System.out.println(v);
    }
}