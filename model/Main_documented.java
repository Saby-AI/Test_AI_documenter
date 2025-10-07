```java
/*
Date: 07/10/2025
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
This documented code maintains functionality while providing comprehensive comments about behavior, structure, and strategies for improvement.