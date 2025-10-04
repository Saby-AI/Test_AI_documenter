```java
/*
Date: 04/10/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
import model.Address; // Model representation for address details
import model.Communication; // Model representation for communication methods
import model.Party; // Main entity encapsulating a party (customer/vendor)
/**
 * This is the entry point for the application, managing the creation
 * and display of parties including their addresses and communication
 * details.
 */
public class Main {
    /**
     * Main method to execute the program, showcasing the creation
     * of parties and their attributes (addresses and communications).
     *
     * @param args Command-line arguments (not utilized)
     */
    public static void main(String[] args) {
        // Creating customer party instance
        Party c = new Party("Alice Johnson", "Person", "Customer", "Active"); // Customer creation
        // Adding billing address for customer
        c.addAddress(new Address("Bill_To", "123 Billing St", "Suite 100", "New York", "NY", "USA", "10001"));
        // Adding shipping address for customer
        c.addAddress(new Address("Ship_To", "456 Shipping Ave", "", "Brooklyn", "NY", "USA", "11201"));
        // Adding communication methods for customer
        c.addCommunication(new Communication("Email", "alice@example.com"));
        c.addCommunication(new Communication("Phone", "+1-555-123-4567"));
        // Output customer details
        System.out.println(c);
        // Creating vendor party instance
        Party v = new Party("Tech Supplies Inc.", "Organization", "Vendor", "Active"); // Vendor creation
        // Adding billing address for vendor
        v.addAddress(new Address("Bill_To", "789 Tech Blvd", "", "San Jose", "CA", "USA", "95112"));
        // Adding shipping address for vendor
        v.addAddress(new Address("Ship_To", "321 Supply Rd", "", "Fremont", "CA", "USA", "94536"));
        // Adding communication methods for vendor
        v.addCommunication(new Communication("Fax", "+1-555-987-6543"));
        v.addCommunication(new Communication("Email", "support@techsupplies.com"));
        // Output vendor details
        System.out.println(v);
    }
}
```
This comprehensive code documentation maintains clarity and ensures that the underlying business logic and structure are well understood, in line with enterprise-level documentation requirements.