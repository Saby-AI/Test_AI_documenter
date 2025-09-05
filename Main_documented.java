/**
Date: 04/09/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/

import model.Address; // Importing Address model
import model.Communication; // Importing Communication model
import model.Party; // Importing Party model

/**
 * The Main class serves as the entry point for the application, 
 * responsible for creating `Party` instances (customers and vendors) 
 * and adding their addresses and communication methods.
 */
public class Main {

    /**
     * The main method - application entry point.
     * 
     * @param args Command line arguments (not used).
     */
    public static void main(String[] args) {
        
        // Creating a customer Party instance
        Party customer = new Party("Alice Johnson", "Person", "Customer", "Active");
        customer.addAddress(new Address("Bill_To", "123 Billing St", "Suite 100", "New York", "NY", "USA", "10001"));
        customer.addAddress(new Address("Ship_To", "456 Shipping Ave", "", "Brooklyn", "NY", "USA", "11201"));
        customer.addCommunication(new Communication("Email", "alice@example.com"));
        customer.addCommunication(new Communication("Phone", "+1-555-123-4567"));
        
        // Outputting customer information
        System.out.println(customer); 
        
        // Creating a vendor Party instance
        Party vendor = new Party("Tech Supplies Inc.", "Organization", "Vendor", "Active");
        vendor.addAddress(new Address("Bill_To", "789 Tech Blvd", "", "San Jose", "CA", "USA", "95112"));
        vendor.addAddress(new Address("Ship_To", "321 Supply Rd", "", "Fremont", "CA", "USA", "94536"));
        vendor.addCommunication(new Communication("Fax", "+1-555-987-6543"));
        vendor.addCommunication(new Communication("Email", "support@techsupplies.com"));
        
        // Outputting vendor information
        System.out.println(vendor); 
    }
}
