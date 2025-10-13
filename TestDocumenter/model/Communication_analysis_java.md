/*
Date: 13/10/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
/**
 * The Communication class represents a means of communication with contact details,
 * including validation for email and phone formats.
 */
package model;
public class communication {
    /**
     * The type of contact, such as 'email', 'phone', or 'fax'.
     */
    public String contacttype;
    /**
     * The contact string, storing the actual contact detail (email or phone).
     */
    public String contact;
    /**
     * Constructor for the Communication class.
     *
     * @param type the type of contact (e.g., "email", "phone", "fax")
     * @param cont the contact information (the email address or phone number)
     * @throws IllegalArgumentException if the provided contact details are invalid
     */
    communication(String type, String cont) {
        contacttype = type;
        contact = cont;
        if(!valid(type, cont)){
            throw new IllegalArgumentException("bad contact " + type);
        }
    }