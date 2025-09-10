/**
Date: 07/09/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
import model.Address; // Importing the Address class from the model package
import model.Communication; // Importing the Communication class from the model package
import model.Party; // Importing the Party class from the model package
public class Main { // Class name corrected to follow Java conventions
    /**
     * Main method to execute the program.
     * It initializes Party instances for a customer and a vendor,
     * adds addresses and communications, and prints the details.
     *
     * @param args Command line arguments (not used).
     */
    public static void main(String[] args) {
        // Creating a Party instance for a customer
        Party customer = new Party("Alice Johnson", "Person", "Customer", "Active"); // Initializing party with basic parameters
        customer.addAddress(new Address("Bill_To", "123 Billing St", "Suite 100", "New York", "NY", "USA", "10001")); // Adding billing address
        customer.addAddress(new Address("Ship_To", "456 Shipping Ave", "", "Brooklyn", "NY", "USA", "11201")); // Adding shipping address
        customer.addCommunication(new Communication("Email", "alice@example.com")); // Adding email communication
        customer.addCommunication(new Communication("Phone", "+1-555-123-4567")); // Adding phone communication
        // Printing out the details for the customer party
        System.out.println(customer); // Expected to call toString() method on the Party object
        // Creating a Party instance for a vendor
        Party vendor = new Party("Tech Supplies Inc.", "Organization", "Vendor", "Active"); // Initializing vendor party
        vendor.addAddress(new Address("Bill_To", "789 Tech Blvd", "", "San Jose", "CA", "USA", "95112")); // Adding billing address
        vendor.addAddress(new Address("Ship_To", "321 Supply Rd", "", "Fremont", "CA", "USA", "94536")); // Adding shipping address
        vendor.addCommunication(new Communication("Fax", "+1-555-987-6543")); // Adding fax communication
        vendor.addCommunication(new Communication("Email", "support@techsupplies.com")); // Adding email communication
        // Printing out the details for the vendor party
        System.out.println(vendor); // Expected to call toString() method on the Party object
    }
}