import model.Address;
import model.Communication;
import model.Party;
public class Main {
    /**
     * The main method of the application. It initializes customer and vendor
     * instances, adds relevant addresses and communication methods, and then
     * prints their information.
     *
     * @param args Command line arguments (not used).
     */
    public static void main(String[] args) {
        // Initializing a Party object for a customer
        Party c = new Party("Alice Johnson", "Person", "Customer", "Active");
        // Adding billing address to the customer
        c.addAddress(new Address("Bill_To", "123 Billing St", "Suite 100", "New York", "NY", "USA", "10001"));
        // Adding shipping address to the customer
        c.addAddress(new Address("Ship_To", "456 Shipping Ave", "", "Brooklyn", "NY", "USA", "11201"));
        // Adding communication details for the customer
        c.addCommunication(new Communication("Email", "alice@example.com"));
        c.addCommunication(new Communication("Phone", "+1-555-123-4567"));
        // Print the customer information
        System.out.println(c);
        // Initializing a Party object for a vendor
        Party v = new Party("Tech Supplies Inc.", "Organization", "Vendor", "Active");
        // Adding billing address to the vendor
        v.addAddress(new Address("Bill_To", "789 Tech Blvd", "", "San Jose", "CA", "USA", "95112"));
        // Adding shipping address to the vendor
        v.addAddress(new Address("Ship_To", "321 Supply Rd", "", "Fremont", "CA", "USA", "94536"));
        // Adding communication methods for the vendor
        v.addCommunication(new Communication("Fax", "+1-555-987-6543"));
        v.addCommunication(new Communication("Email", "support@techsupplies.com"));
        // Print the vendor information
        System.out.println(v);
    }
}