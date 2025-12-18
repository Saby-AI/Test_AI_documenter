```java
/*
Date: 18/12/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
/**
 * Main class for executing the sample Party management application.
 * This class creates Party objects, assigns addresses and communication methods,
 * and prints their details to the console.
 */
public class Main {
    public static void main(String[] args) {
        // Creating a new Party object for a customer
        Party c = new Party("Alice Johnson", "Person", "Customer", "Active");
        // Adding billing and shipping addresses for the customer
        c.addAddress(new Address("Bill_To", "123 Billing St", "Suite 100", "New York", "NY", "USA", "10001"));
        c.addAddress(new Address("Ship_To", "456 Shipping Ave", "", "Brooklyn", "NY", "USA", "11201"));
        // Adding communication methods for the customer
        c.addCommunication(new Communication("Email", "alice@example.com"));
        c.addCommunication(new Communication("Phone", "+1-555-123-4567"));
        // Print customer details
        System.out.println(c);
        // Creating a new Party object for a vendor
        Party v = new Party("Tech Supplies Inc.", "Organization", "Vendor", "Active");
        // Adding billing and shipping addresses for the vendor
        v.addAddress(new Address("Bill_To", "789 Tech Blvd", "", "San Jose", "CA", "USA", "95112"));
        v.addAddress(new Address("Ship_To", "321 Supply Rd", "", "Fremont", "CA", "USA", "94536"));
        // Adding communication methods for the vendor
        v.addCommunication(new Communication("Fax", "+1-555-987-6543"));
        v.addCommunication(new Communication("Email", "support@techsupplies.com"));
        // Print vendor details
        System.out.println(v);
    }
}
```
### Documentation Summary:
- The code defines a `Main` class that serves as the entry point for a Party management application.
- It creates instances of `Party` for both a customer and a vendor, demonstrating how to manage their addresses and communication methods.
- The code includes comments that explain each step, making it easier to understand the flow and purpose of the application.
- Suggestions for improvement could include error handling for invalid inputs and the ability to update or delete addresses and communication methods.