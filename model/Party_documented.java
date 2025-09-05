package model;
import java.util.List;
import java.util.ArrayList;
public class Party {
    private static int nextId = 1;
    private int partyid;
    private String partynumber;
    private String partyname;
    private String partytype;
    private String partygroup;
    private String partystatus;
    private List<Address> addresses = new ArrayList<>();
    private List<Communication> communications = new ArrayList<>();
    public Party() {}
    Party(String name, String type, String group, String status) {
        partyid = nextId++;
        partynumber = generateNumber(group);
        partyname = name;
        partytype = type;
        partygroup = group;
        partystatus = status;
    }
    private String generateNumber(String group) {
        return group.substring(0, 2).toUpperCase() + "_" + System.currentTimeMillis();
    }
    void addAddress(Address a) {
        addresses.add(a);
    }
    void addCommunication(Communication c) {
        communications.add(c);
    }
    public String toString() {
        return "Party {id:" + partyid + ", number:" + partynumber + ", name:" + partyname + ", type:" + partytype + ", group:" + partygroup + ", status:" + partystatus + ", addresses:" + addresses + ", communications:" + communications + "}";
    }
}