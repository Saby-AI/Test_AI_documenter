```java
/*
Date: 28/10/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
/**
 * The Party class represents a party event with a name and a number of guests.
 */
public class Party {
    private String name; // The name of the party
    private int guests;  // The number of guests attending the party
    /**
     * Constructor to initialize a Party object with a name and number of guests.
     *
     * @param name   The name of the party.
     * @param guests The number of guests attending the party.
     */
    public Party(String name, int guests) {
        this.name = name;
        this.guests = guests;
    }
    // Setter for name is commented out
    // public void setName(String name) {
    // }
    /**
     * Gets the name of the party.
     *
     * @return The name of the party.
     */
    public String getName() {
        return name;
    }
    // Setter for guests is commented out
    // public void setGuests(int guests) {
    // }
    /**
     * Gets the number of guests attending the party.
     *
     * @return The number of guests.
     */
    public int getGuests() {
        return guests;
    }
    /**
     * Formats the details of the party into a string.
     *
     * @return A string representation of the party details.
     */
    public String formatDetails() {
        return "Party Name: " + name + ", Number of Guests: " + guests;
    }
    /**
     * Prints the details of the party to the console.
     */
    public void printDetails() {
        StringBuilder sb = new StringBuilder();
        sb.append("Party Name: ").append(name).append(", Number of Guests: ").append(guests);
        System.out.println(sb.toString());
    }
}
```