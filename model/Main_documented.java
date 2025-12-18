```java
/*
Date: 18/12/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
import model.Address;
import model.Communication;
import model.Party;
public class main {
    public static void main(String[] args) {
        // Create a new Party instance for a customer named Alice Johnson
        Party c = new Party("Alice Johnson", "Person", "Customer", "Active");
        // Add billing and shipping addresses for the customer
        c.addAddress(new Address("Bill_To", "123 Billing St", "Suite 100", "New York", "NY", "USA", "10001"));
        c.addAddress(new Address("Ship_To", "456 Shipping Ave", "", "Brooklyn", "NY", "USA", "11201"));
        // Add communication methods for the customer
        c.addCommunication(new Communication("Email", "alice@example.com"));
        c.addCommunication(new Communication("Phone", "+1-555-123-4567"));
        // Print the customer details
        System.out.println(c);
        // Create a new Party instance for a vendor named Tech Supplies Inc.
        Party v = new Party("Tech Supplies Inc.", "Organization", "Vendor", "Active");
        // Add billing and shipping addresses for the vendor
        v.addAddress(new Address("Bill_To", "789 Tech Blvd", "", "San Jose", "CA", "USA", "95112"));
        v.addAddress(new Address("Ship_To", "321 Supply Rd", "", "Fremont", "CA", "USA", "94536"));
        // Add communication methods for the vendor
        v.addCommunication(new Communication("Fax", "+1-555-987-6543"));
        v.addCommunication(new Communication("Email", "support@techsupplies.com"));
        // Print the vendor details
        System.out.println(v);
    }
}
```