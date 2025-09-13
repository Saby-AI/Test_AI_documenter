/*
Date: 13/09/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
/**
 * Main class serves as the entry point to the application that manages different types of parties.
 */
public class Main {
    /**
     * Main method to run the application.
     *
     * @param args command line arguments passed during execution.
     */
    public static void main(String[] args) {
        Party c = new Party("Alice Johnson", "Person", "Customer", "Active");
        c.addAddress(new Address("Bill_To", "123 Billing St", "Suite 100", "New York", "NY", "USA", "10001"));
        c.addAddress(new Address("Ship_To", "456 Shipping Ave", "", "Brooklyn", "NY", "USA", "11201"));
        c.addCommunication(new Communication("Email", "alice@example.com"));
        c.addCommunication(new Communication("Phone", "+1-555-123-4567"));
        System.out.println(c);