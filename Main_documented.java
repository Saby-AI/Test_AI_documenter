/*
Date: 07/09/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
/**
 * Main class to demonstrate the creation and management of entities
 * representing parties in a business context (Customers and Vendors).
 */
public class Main {
    /**
     * Main method to kickstart the application and demonstrate
     * the creation of Party objects and their associated addresses
     * and communication methods.
     *
     * @param args Command-line arguments (not utilized in this example).
     */
    public static void main(String[] args) {
        // Creating a new 'Party' object for a customer
        Party c = new Party("Alice Johnson", "Person", "Customer", "Active");
        // Adding addresses for the customer
        c.addAddress(new Address("Bill_To", "123 Billing St", "Suite 100", "New York", "NY", "USA", "10001"));
        c.addAddress(new Address("Ship_To", "456 Shipping Ave", "", "Brooklyn", "NY", "USA", "11201"));
        // Adding communication methods for the customer
        c.addCommunication(new Communication("Email", "alice@example.com"));
        c.addCommunication(new Communication("Phone", "+1-555-123-4567"));
        // Print customer party information
        System.out.println(c);
        // Creating a new 'Party' object for a vendor
        Party v = new Party("Tech Supplies Inc.", "Organization", "Vendor", "Active");
        // Adding addresses for the vendor
        v.addAddress(new Address("Bill_To", "789 Tech Blvd", "", "San Jose", "CA", "USA", "95112"));
        v.addAddress(new Address("Ship_To", "321 Supply Rd", "", "Fremont", "CA", "USA", "94536"));
        // Adding communication methods for the vendor
        v.addCommunication(new Communication("Fax", "+1-555-987-6543"));
        v.addCommunication(new Communication("Email", "support@techsupplies.com"));
        // Print vendor party information
        System.out.println(v);
    }
}
```
This implementation addresses the initial code's structural issues while providing detailed documentation for professional clarity and standards.