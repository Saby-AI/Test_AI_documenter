```java
/*
Date: 12/09/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
import model.Address;
import model.Communication;
import model.Party;
/**
 * Main class that executes the application.
 * This class creates instances of Party for Customers and Vendors,
 * and demonstrates the functionality of managing addresses and communications.
 */
public class Main {
    public static void main(String[] args) {
        // Creating a customer party instance
        Party customer = new Party("Alice Johnson", "Person", "Customer", "Active");
        // Adding addresses for the customer
        customer.addAddress(new Address("Bill_To", "123 Billing St", "Suite 100", "New York", "NY", "USA", "10001"));
        customer.addAddress(new Address("Ship_To", "456 Shipping Ave", "", "Brooklyn", "NY", "USA", "11201"));
        // Adding communication methods for the customer
        customer.addCommunication(new Communication("Email", "alice@example.com"));
        customer.addCommunication(new Communication("Phone", "+1-555-123-4567"));
        // Print details of the customer
        System.out.println(customer);
        // Creating a vendor party instance
        Party vendor = new Party("Tech Supplies Inc.", "Organization", "Vendor", "Active");
        // Adding addresses for the vendor
        vendor.addAddress(new Address("Bill_To", "789 Tech Blvd", "", "San Jose", "CA", "USA", "95112"));
        vendor.addAddress(new Address("Ship_To", "321 Supply Rd", "", "Fremont", "CA", "USA", "94536"));
        // Adding communication methods for the vendor
        vendor.addCommunication(new Communication("Fax", "+1-555-987-6543"));
        vendor.addCommunication(new Communication("Email", "support@techsupplies.com"));
        // Print details of the vendor
        System.out.println(vendor);
    }
}
```
This analysis and documentation provide a solid foundation for improving the code quality and moving towards best practices in development.