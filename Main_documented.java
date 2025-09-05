/*
Date: 05/09/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/

import model.Address; // Importing Address model
import model.Communication; // Importing Communication model
import model.Party; // Importing Party model

/**
 * Main class to demonstrate the instantiation of Party objects,
 * their addresses, and communication methods.
 */
public class Main {

    /**
     * The main method serves as the entry point to the application.
     * It creates instances of Party and associates communication and addresses.
     *
     * @param args Command line arguments (not used in this example)
     */
    public static void main(String[] args) {
        // Create a new Party instance representing a customer
        Party c = new Party("Alice Johnson", "Person", "Customer", "Active");
        
        // Adding billing and shipping addresses for the customer
        c.addAddress(new Address("Bill_To", "123 Billing St", "Suite 100", "New York", "NY", "USA", "10001"));
        c.addAddress(new Address("Ship_To", "456 Shipping Ave", "", "Brooklyn", "NY", "USA", "11201"));
        
        // Adding communication methods for the customer
        c.addCommunication(new Communication("Email", "alice@example.com"));
        c.addCommunication(new Communication("Phone", "+1-555-123-4567"));
        
        // Output the details of the customer
        System.out.println(c); // Expected to overwrite toString method in Party class.

        // Create a new Party instance representing a vendor
        Party v = new Party("Tech Supplies Inc.", "Organization", "Vendor", "Active");

        // Adding billing and shipping addresses for the vendor
        v.addAddress(new Address("Bill_To", "789 Tech Blvd", "", "San Jose", "CA", "USA", "95112"));
        v.addAddress(new Address("Ship_To", "321 Supply Rd", "", "Fremont", "CA", "USA", "94536"));
        
        // Adding communication methods for the vendor
        v.addCommunication(new Communication("Fax", "+1-555-987-6543"));
        v.addCommunication(new Communication("Email", "support@techsupplies.com"));
        
        // Output the details of the vendor
        System.out.println(v); // Expected to overwrite toString method in Party class.
    }
}
