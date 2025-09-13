```java
/*
Date: 13/09/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
import model.Address; // Importing the Address class from the model package
import model.Communication; // Importing the Communication class from the model package
import model.Party; // Importing the Party class from the model package
/**
 * The main class is responsible for executing the application,
 * creating Party instances with their associated addresses and communications.
 */
public class main {
    /**
     * Main method where the execution starts.
     *
     * @param args Command-line arguments.
     */
    public static void main(String[] args) {
        // Creating a new Party instance representing a Customer
        Party c = new Party("Alice Johnson", "Person", "Customer", "Active");
        // Adding addresses associated with the Customer
        c.addAddress(new Address("Bill_To", "123 Billing St", "Suite 100", "New York", "NY", "USA", "10001"));
        c.addAddress(new Address("Ship_To", "456 Shipping Ave", "", "Brooklyn", "NY", "USA", "11201"));
        // Adding communication methods associated with the Customer
        c.addCommunication(new Communication("Email", "alice@example.com"));
        c.addCommunication(new Communication("Phone", "+1-555-123-4567"));
        // Outputting the Customer information
        System.out.println(c);