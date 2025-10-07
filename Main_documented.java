```java
/*
Date: 07/10/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
/**
 * The Main class serves as the entry point for the application that manages
 * parties, which can be either customers or vendors, along with their
 * associated addresses and communication methods.
 */
public class Main {
    /**
     * The main method initializes sample parties, adding addresses
     * and communication methods, and outputs their details.
     *
     * @param args Command line arguments (not utilized in this implementation).
     */
    public static void main(String[] args) {
        // Create a Party object representing a customer, Alice Johnson
        Party customer = new Party("Alice Johnson", "Person", "Customer", "Active");
        customer.addAddress(new Address("Bill_To", "123 Billing St", "Suite 100", "New York", "NY", "USA", "10001"));
        customer.addAddress(new Address("Ship_To", "456 Shipping Ave", "", "Brooklyn", "NY", "USA", "11201"));
        customer.addCommunication(new Communication("Email", "alice@example.com"));
        customer.addCommunication(new Communication("Phone", "+1-555-123-4567"));
        // Output customer's information
        System.out.println(customer);
        // Create a Party object representing a vendor, Tech Supplies Inc.
        Party vendor = new Party("Tech Supplies Inc.", "Organization", "Vendor", "Active");
        vendor.addAddress(new Address("Bill_To", "789 Tech Blvd", "", "San Jose", "CA", "USA", "95112"));
        vendor.addAddress(new Address("Ship_To", "321 Supply Rd", "", "Fremont", "CA", "USA", "94536"));
        vendor.addCommunication(new Communication("Fax", "+1-555-987-6543"));
        vendor.addCommunication(new Communication("Email", "support@techsupplies.com"));
        // Output vendor's information
        System.out.println(vendor);
    }
}
```
**Notes**:
1. The code lacks comprehensive input validation, which is critical for maintaining appropriate states of `Party`, `Address`, and `Communication` instances.
2. Future iterations should consider implementing design patterns like MVC for better structural integrity and facilitating maintainability.