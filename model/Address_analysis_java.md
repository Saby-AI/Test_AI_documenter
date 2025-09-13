/*
Date: 13/09/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
package model;
/**
 * Class Address represents an address associated with a party.
 */
public class Address {
    static int addressCounter = 1;
    int partyAddressId;
    String addressType;
    String addressLine1;
    String addressLine2;
    String city;
    String state;
    String country;
    String postalCode;
    /**
     * Creates a new instance of Address.
     *
     * @param type Type of address (e.g., billing, shipping).
     * @param line1 First line of the address.
     * @param line2 Second line of the address (optional).
     * @param city The city of the address.
     * @param state The state of the address.
     * @param country The country of the address.
     * @param postalcode The postal code of the address.
     */
    Address(String type, String line1, String line2, String city, String state, String country, String postalcode) {
        partyAddressId = addressCounter++;
        this.addressType = type;
        this.addressLine1 = line1;
        this.addressLine2 = line2;
        this.city = city;
        this.state = state;
        this.country = country;
        this.postalCode = postalcode;
    }