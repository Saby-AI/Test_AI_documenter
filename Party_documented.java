```java
/*
Date: 07/10/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
/**
 * Represents a party with a specific name and a number of guests.
 * This class maintains details about the party and provides
 * methods to format and print these details.
 */
public class Party {
    // Name of the party
    private String name;
    // Number of guests attending the party
    private int guests;
    /**
     * Constructs a Party object with the specified name and number of guests.
     *
     * @param name   the name of the party
     * @param guests the number of guests at the party
     */
    public Party(String name, int guests) {
        this.name = name;
        this.guests = guests;
    }
    /**
     * Retrieves the name of the party.
     *
     * @return the name of the party
     */
    public String getName() {
        return name;
    }
    /**
     * Retrieves the number of guests attending the party.
     *
     * @return the number of guests at the party
     */
    public int getGuests() {
        return guests;
    }
    /**
     * Formats the details of the party into a readable string.
     *
     * @return formatted string containing party name and guest count
     */
    public String formatDetails() {
        return "Party Name: " + name + ", Number of Guests: " + guests;
    }
    /**
     * Prints the party details to the console.
     * This method uses StringBuilder for efficient string concatenation.
     */
    public void printDetails() {
        // Using StringBuilder to concatenate the string efficiently
        StringBuilder sb = new StringBuilder();
        sb.append("Party Name: ")
          .append(name)
          .append(", Number of Guests: ")
          .append(guests);
        // Output the formatted string to the console
        System.out.println(sb.toString());
    }
}
```