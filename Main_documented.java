```java
/*
Date: 27/10/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
import model.Address;
import model.Communication;
import model.Party;
/**
 * Main class to demonstrate the functionality of the Party management system.
 * This class serves as the entry point for the application.
 */
public class Main {
    /**
     * The main method that initializes party objects and demonstrates their usage.
     *
     * @param args Command line arguments (not used).
     */
    public static void main(String[] args) {
        // Create a new Party object for a customer
        Party customer = new Party("Alice Johnson", "Person", "Customer", "Active");
        customer.addAddress(new Address("Bill_To", "123 Billing St", "Suite 100", "New York", "NY", "USA", "10001"));
        customer.addAddress(new Address("Ship_To", "456 Shipping Ave", "", "Brooklyn", "NY", "USA", "11201"));
        customer.addCommunication(new Communication("Email", "alice@example.com"));
        customer.addCommunication(new Communication("Phone", "+1-555-123-4567"));
        System.out.println(customer);
        // Create a new Party object for a vendor
        Party vendor = new Party("Tech Supplies Inc.", "Organization", "Vendor", "Active");
        vendor.addAddress(new Address("Bill_To", "789 Tech Blvd", "", "San Jose", "CA", "USA", "95112"));
        vendor.addAddress(new Address("Ship_To", "321 Supply Rd", "", "Fremont", "CA", "USA", "94536"));
        vendor.addCommunication(new Communication("Fax", "+1-555-987-6543"));
        vendor.addCommunication(new Communication("Email", "support@techsupplies.com"));
        System.out.println(vendor);
    }
}
```