/*
Date: 13/10/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
import model.Address; // Import the Address model
import model.Communication; // Import the Communication model
import model.Party; // Import the Party model
public class Main { // Class name should be capitalized
    public static void main(String[] args) { // Main method entry point
        // Create a new Party instance for a customer named Alice Johnson
        Party c = new Party("Alice Johnson", "Person", "Customer", "Active");
        // Add addresses to the Customer
        c.addAddress(new Address("Bill_To", "123 Billing St", "Suite 100", "New York", "NY", "USA", "10001"));
        c.addAddress(new Address("Ship_To", "456 Shipping Ave", "", "Brooklyn", "NY", "USA", "11201"));
        // Add contact methods for the Customer
        c.addCommunication(new Communication("Email", "alice@example.com"));
        c.addCommunication(new Communication("Phone", "+1-555-123-4567"));
        // Output the Customer details
        System.out.println(c); // Print the Customer information