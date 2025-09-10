/*
Date: 07/09/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
/**
 * Main class to demonstrate the Party management system.
 */
public class Main {
    /**
     * Main method to execute the Party management example.
     *
     * @param args Command line arguments.
     */
    public static void main(String[] args) {
        // Create a Party instance for a customer
        Party c = new Party("Alice Johnson", "Person", "Customer", "Active");
        // Adding billing address for the customer
        c.addAddress(new Address("Bill_To", "123 Billing St", "Suite 100", "New York", "NY", "USA", "10001"));
        // Adding shipping address for the customer
        c.addAddress(new Address("Ship_To", "456 Shipping Ave", "", "Brooklyn", "NY", "USA", "11201"));
        // Adding communications methods for the customer
        c.addCommunication(new Communication("Email", "alice@example.com"));
        c.addCommunication(new Communication("Phone", "+1-555-123-4567"));
        // Print customer information
        System.out.println(c); // This assumes that Party class has a toString() method overridden appropriately
        // Create a Party instance for a vendor
        Party v = new Party("Tech Supplies Inc.", "Organization", "Vendor", "Active");
        // Adding billing address for the vendor
        v.addAddress(new Address("Bill_To", "789 Tech Blvd", "", "San Jose", "CA", "USA", "95112"));
        // Adding shipping address for the vendor
        v.addAddress(new Address("Ship_To", "321 Supply Rd", "", "Fremont", "CA", "USA", "94536"));
        // Adding communications methods for the vendor
        v.addCommunication(new Communication("Fax", "+1-555-987-6543"));
        v.addCommunication(new Communication("Email", "support@techsupplies.com"));
        // Print vendor information
        System.out.println(v); // Same assumption about toString() method in Party class
    }
}