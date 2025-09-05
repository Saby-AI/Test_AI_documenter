/*
Date: 05/09/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/

/**
 * The main class for the Party Management application.
 * This class initializes customer and vendor data, 
 * creating instances of the Party class with their respective addresses 
 * and communication methods.
 */
public class Main {

    /**
     * The entry point of the application.
     * @param args Command-line arguments (not used).
     */
    public static void main(String[] args) {
        // Create a customer instance and add their information
        Party c = new Party("Alice Johnson", "Person", "Customer", "Active");
        c.addAddress(new Address("Bill_To", "123 Billing St", "Suite 100", "New York", "NY", "USA", "10001"));
        c.addAddress(new Address("Ship_To", "456 Shipping Ave", "", "Brooklyn", "NY", "USA", "11201"));
        c.addCommunication(new Communication("Email", "alice@example.com"));
        c.addCommunication(new Communication("Phone", "+1-555-123-4567"));
        // Print customer information
        System.out.println(c);

        // Create a vendor instance and add their information
        Party v = new Party("Tech Supplies Inc.", "Organization", "Vendor", "Active");
        v.addAddress(new Address("Bill_To", "789 Tech Blvd", "", "San Jose", "CA", "USA", "95112"));
        v.addAddress(new Address("Ship_To", "321 Supply Rd", "", "Fremont", "CA", "USA", "94536"));
        v.addCommunication(new Communication("Fax", "+1-555-987-6543"));
        v.addCommunication(new Communication("Email", "support@techsupplies.com"));
        // Print vendor information
        System.out.println(v);
    }
}