```java
/*
Date: 19/09/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
import model.Address; // Importing the Address model
import model.Communication; // Importing the Communication model
import model.Party; // Importing the Party model
/**
 * Main class to demonstrate the creation of Party objects
 * and manage their associated addresses and communications.
 */
public class Main {
    /**
     * The main method serves as the entry point for the Java application.
     * It creates instances of Party representing customers and vendors,
     * adds their addresses and communication details, and prints them.
     *
     * @param args Command line arguments (not used in this application)
     */
    public static void main(String[] args) {
        // Creating a customer instance of Party
        Party c = new Party("Alice Johnson", "Person", "Customer", "Active");
        c.addAddress(new Address("Bill_To", "123 Billing St", "Suite 100", "New York", "NY", "USA", "10001"));
        c.addAddress(new Address("Ship_To", "456 Shipping Ave", "", "Brooklyn", "NY", "USA", "11201"));
        c.addCommunication(new Communication("Email", "alice@example.com"));
        c.addCommunication(new Communication("Phone", "+1-555-123-4567"));
        // Printing the customer details
        System.out.println(c);
        // Creating a vendor instance of Party
        Party v = new Party("Tech Supplies Inc.", "Organization", "Vendor", "Active");
        v.addAddress(new Address("Bill_To", "789 Tech Blvd", "", "San Jose", "CA", "USA", "95112"));
        v.addAddress(new Address("Ship_To", "321 Supply Rd", "", "Fremont", "CA", "USA", "94536"));
        v.addCommunication(new Communication("Fax", "+1-555-987-6543"));
        v.addCommunication(new Communication("Email", "support@techsupplies.com"));
        // Printing the vendor details
        System.out.println(v);
    }
}
```
**Note:** The provided Java code has been documented thoroughly, and syntax errors have been identified. Further refinements can enhance usability and code quality, making it suitable for enterprise-level applications.