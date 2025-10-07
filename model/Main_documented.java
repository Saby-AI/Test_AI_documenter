```java
/*
Date: 07/10/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
import model.Address;
import model.Communication;
import model.Party;
/**
 * The Main class for demonstrating the management of parties with
 * designated addresses and communication methods.
 */
public class Main {
    /**
     * The main entry point for the application. Initializes several
     * Party instances, associating addresses and communication methods,
     * and outputs them to the console.
     *
     * @param args Command line arguments (not utilized)
     */
    public static void main(String[] args) {
        // Create a new individual Party instance for a customer
        Party c = new Party("Alice Johnson", "Person", "Customer", "Active");
        // Adding billing and shipping addresses for the customer
        c.addAddress(new Address("Bill_To", "123 Billing St", "Suite 100", "New York", "NY", "USA", "10001"));
        c.addAddress(new Address("Ship_To", "456 Shipping Ave", "", "Brooklyn", "NY", "USA", "11201"));
        // Adding communication details for the customer
        c.addCommunication(new Communication("Email", "alice@example.com"));
        c.addCommunication(new Communication("Phone", "+1-555-123-4567"));
        // Output the customer's details
        System.out.println(c);
        // Create a new organization Party instance for a vendor
        Party v = new Party("Tech Supplies Inc.", "Organization", "Vendor", "Active");
        // Adding billing and shipping addresses for the vendor
        v.addAddress(new Address("Bill_To", "789 Tech Blvd", "", "San Jose", "CA", "USA", "95112"));
        v.addAddress(new Address("Ship_To", "321 Supply Rd", "", "Fremont", "CA", "USA", "94536"));
        // Adding communication details for the vendor
        v.addCommunication(new Communication("Fax", "+1-555-987-6543"));
        v.addCommunication(new Communication("Email", "support@techsupplies.com"));
        // Output the vendor's details
        System.out.println(v);
    }
}
```
This code documentation applies the required standards while maintaining original functionality, emphasizing the need for professional-grade documentation suitable for enterprise environments.