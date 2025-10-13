/**
     * Sets the number of guests attending the party.
     *
     * @param guests The new number of guests.
     */
    public void setGuests(int guests) {
        this.guests = guests;
    }
    /**
     * Retrieves the number of guests attending the party.
     *
     * @return The number of guests.
     */
    public int getGuests() {
        return guests;
    }
    /**
     * Formats the party details into a readable string.
     *
     * @return A formatted string containing the party name and number of guests.
     */
    public String formatDetails() {
        return "Party Name: " + name + ", Number of Guests: " + guests;
    }
    /**
     * Prints the party details to the console in a user-friendly format.
     */
    public void printDetails() {
        StringBuilder sb = new StringBuilder();
        sb.append("Party Name: ").append(name)
          .append(", Number of Guests: ").append(guests);
        System.out.println(sb.toString());
    }
    /**
     * Returns a string representation of the party.
     *
     * @return A formatted string containing the party name and number of guests.
     */
    @Override
    public String toString() {
        return formatDetails();
    }
}