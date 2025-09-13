/*
Date: 13/09/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
import model.Address;  // Import statement for Address class
import model.Communication;  // Import statement for Communication class
import model.Party;  // Import statement for Party class
public class main {  // Class definition for main
    public static void main(String[] args) {  // Main method for execution
        // Creating a new Party instance for a customer named Alice Johnson
        Party c = new Party("Alice Johnson", "Person", "Customer", "Active");
        // Adding billing and shipping addresses for the customer
        c.addAddress(new Address("Bill_To", "123 Billing St", "Suite 100", "New York", "NY", "USA", "10001"));
        c.addAddress(new Address("Ship_To", "456 Shipping Ave", "", "Brooklyn", "NY", "USA", "11201"));
        // Adding communication methods for the customer
        c.addCommunication(new Communication("Email", "alice@example.com"));
        c.addCommunication(new Communication("Phone", "+1-555-123-4567"));
        // Printing information about the customer
        System.out.println(c);