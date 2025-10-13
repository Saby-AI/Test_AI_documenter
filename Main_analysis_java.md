/*
Date: 13/10/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
import model.Address;
import model.Communication;
import model.Party;
/**
 * This is the main class of the application that serves as the entry point.
 * It manages the creation and handling of Party entities, representing
 * individuals and organizations along with their respective addresses
 * and communication methods.
 */
public class Main {
    /**
     * The main method that serves as the entry point for the application.
     * It creates two different Party entities (Customer and Vendor), adds addresses
     * and communication details, and prints their information.
     *
     * @param args command-line arguments
     */
    public static void main(String[] args) {
        // Create a customer Party
        Party customer = new Party("Alice Johnson", "Person", "Customer", "Active");
        customer.addAddress(new Address("Bill_To", "123 Billing St", "Suite 100", "New York", "NY", "USA", "10001"));
        customer.addAddress(new Address("Ship_To", "456 Shipping Ave", "", "Brooklyn", "NY", "USA", "11201"));
        customer.addCommunication(new Communication("Email", "alice@example.com"));
        customer.addCommunication(new Communication("Phone", "+1-555-123-4567"));
        // Print the customer information
        System.out.println(customer);