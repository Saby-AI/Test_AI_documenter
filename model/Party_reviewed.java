public class Party {
    private String name;
    private int guests;
    public Party(String name, int guests) {
        this.name = name;
        this.guests = guests;
    }
    public String getName() {
        return name;
    }
    public int getGuests() {
        return guests;
    }
    public String formatDetails() {
        return "Party Name: " + name + ", Number of Guests: " + guests;
    }
    public void printDetails() {
        System.out.println(formatDetails());
    }
}