/*
Date: 13/10/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
package model;
import java.util.ArrayList;
import java.util.List;
/**
 * Represents a Party with basic details including name, type, role, status,
 * and associated addresses and communications.
 *
 * This is the expected Party class structure that matches the requirements
 * from Main.java, which expects methods like addAddress() and addCommunication().
 */
public class Party {
    /** The name of the party */
    private String name;
    /** The type of the party (e.g., Person, Organization) */
    private String type;
    /** The role of the party (e.g., Customer, Vendor) */
    private String role;
    /** The current status of the party (e.g., Active, Inactive) */
    private String status;
    /** List of addresses associated with this party */
    private List<Address> addresses;
    /** List of communication methods associated with this party */
    private List<Communication> communications;
    /**
     * Constructs a new Party with the specified details.
     *
     * @param name   The name of the party.
     * @param type   The type of the party.
     * @param role   The role of the party in their respective context.
     * @param status The current status of the party.
     */
    public Party(String name, String type, String role, String status) {
        this.name = name;
        this.type = type;
        this.role = role;
        this.status = status;
        this.addresses = new ArrayList<>();
        this.communications = new ArrayList<>();
    }
    /**
     * Adds an address to the party.
     *
     * @param address The address to be added.
     */
    public void addAddress(Address address) {
        if (address != null && isValidAddress(address)) {
            addresses.add(address);
        }
    }
    /**
     * Adds a communication method to the party.
     *
     * @param communication The communication method to be added.
     */
    public void addCommunication(Communication communication) {
        if (communication != null && isValidCommunication(communication)) {
            communications.add(communication);
        }
    }
    /**
     * Checks for the validity of an address.
     *
     * @param address The address to validate.
     * @return boolean indicating if the address is valid.
     */
    private boolean isValidAddress(Address address) {
        // Additional validation logic can be added here.
        return true;
    }