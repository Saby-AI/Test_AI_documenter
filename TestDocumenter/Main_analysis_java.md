```java
/*
Date: 13/10/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
/**
 * This class serves as the entry point for the application,
 * showcasing how to create Party instances with associated addresses
 * and communications.
 */
public class main {
    /**
     * The main method is the entry point of the Java application.
     * It creates instances of Party representing a customer and a vendor,
     * adds addresses and communication details to them,
     * and prints their information to the console.
     *
     * @param args Command-line arguments.
     */
    public static void main(String[] args) {
        // Creating a Party instance for a customer
        Party c = new Party("Alice Johnson", "Person", "Customer", "Active");
        c.addAddress(new Address("Bill_To", "123 Billing St", "Suite 100", "New York", "NY", "USA", "10001"));
        c.addAddress(new Address("Ship_To", "456 Shipping Ave", "", "Brooklyn", "NY", "USA", "11201"));
        c.addCommunication(new Communication("Email", "alice@example.com"));
        c.addCommunication(new Communication("Phone", "+1-555-123-4567"));
        // Outputting customer information
        System.out.println(c);
        // Creating a Party instance for a vendor
        Party v = new Party("Tech Supplies Inc.", "Organization", "Vendor", "Active");
        v.addAddress(new Address("Bill_To", "789 Tech Blvd", "", "San Jose", "CA", "USA", "95112"));
        v.addAddress(new Address("Ship_To", "321 Supply Rd", "", "Fremont", "CA", "USA", "94536"));
        v.addCommunication(new Communication("Fax", "+1-555-987-6543"));
        v.addCommunication(new Communication("Email", "support@techsupplies.com"));