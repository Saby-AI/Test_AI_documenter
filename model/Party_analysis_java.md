/*
Date: 13/09/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
/**
 * Class Party represents a party entity including its name, guests, and related details.
 */
public class Party {
    private String name;
    private int guests;
    /**
     * Constructs a new instance of Party.
     *
     * @param name the name of the party
     * @param guests the number of guests at the party.
     */
    public Party(String name, int guests) {
        this.name = name;
        this.guests = guests;
    }