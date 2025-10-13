/*
Date: 13/10/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
package model; // Package declaration for the model
public class Address { // Class representing an Address
    static int addressCounter = 1; // Static variable for unique address ID
    int partyAddressId; // Unique ID for the address
    String addressType; // Type of address
    String addressLine1; // First line of the address
    String addressLine2; // Second line of the address
    String city; // City name
    String state; // State name
    String country; // Country name
    String postalCode; // Postal code
    // Constructor for Address
    public Address(String type, String line1, String line2, String city, String state, String country, String postalCode) {
        this.partyAddressId = addressCounter++; // Increment and assign unique ID
        this.addressType = type; // Assign address type
        this.addressLine1 = line1; // Assign first line of address
        this.addressLine2 = line2; // Assign second line of address
        this.city = city; // Assign city
        this.state = state; // Assign state
        this.country = country; // Assign country
        this.postalCode = postalCode; // Assign postal code
    }