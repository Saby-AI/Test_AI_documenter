/*
Date: 13/10/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
package model; // Package declaration for the model
public class Communication { // Class for storing communication details
    public String contactType; // Type of contact (e.g., Email, Phone)
    public String contact; // The contact information
    // Constructor for Communication
    public Communication(String type, String cont) {
        this.contactType = type; // Assign contact type
        this.contact = cont; // Assign contact
        if (!valid(type, cont)) { // Validate the type and contact
            throw new IllegalArgumentException("bad contact " + type); // Handle invalid contact
        }
    }