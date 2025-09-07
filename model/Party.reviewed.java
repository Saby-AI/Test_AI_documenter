package model;
import java.util.List;
public class Party {
    private final List<String> guests;
    private String location;
    private String time;
    public Party(List<String> guests, String location, String time) {
        this.guests = guests;
        this.location = location;
        this.time = time;
    }
    public boolean addGuest(String guest) {
        if (!guests.contains(guest)) {
            guests.add(guest);
            return true;
        }
        return false;
    }
    public boolean removeGuest(String guest) {
        return guests.remove(guest);
    }
    public List<String> getGuests() {
        return guests;
    }
    public String getLocation() {
        return location;
    }
    public String getTime() {
        return time;
    }
}