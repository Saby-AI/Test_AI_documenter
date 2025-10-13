/*
Date: 13/10/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
package model;
/**
 * Represents a communication model used for storing contact information
 * and performing validation based on the type of contact (email, phone, fax).
 * <p>
 * Provides methods to validate the format of contact types.
 * </p>
 */
public class Communication {
    /** The type of contact (e.g., email, phone, fax). */
    private String contactType;
    /** The contact information (e.g., email address, phone number). */
    private String contact;
    /**
     * Constructs a new Communication instance with the specified type and contact.
     *
     * @param type the type of contact (email, phone, fax)
     * @param cont the contact information
     * @throws IllegalArgumentException if the contact type or information is invalid
     */
    public Communication(String type, String cont) {
        this.contactType = type;
        this.contact = cont;
        if (!valid(type, cont)) {
            throw new IllegalArgumentException("bad contact " + type);
        }
    }