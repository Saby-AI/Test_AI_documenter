package model;

import java.util.List;
import java.util.ArrayList;

public class Party {
    private int nextId = 1;

    private int partyId;
    private String partyNumber;
    private String partyName;
    private String partyType;
    private String partyGroup;
    private String partyStatus;

    private List<Address> addresses = new ArrayList<Address>();
    private List<Communication> communications = new ArrayList<Communication>();

    public Party(String name, String type, String group, String status) {
        partyId = nextId++;
        partyNumber = generatePartyNumber(group);
        partyName = name;
        partyType = type;
        partyGroup = group;
        partyStatus = status;
    }

    private String generatePartyNumber(String g) {
        return g.substring(0, 2).toUpperCase() + "_" + System.currentTimeMillis();
    }

    public void addAddress(Address a) {
        addresses.add(a);
    }

    public void addCommunication(Communication c) {
        communications.add(c);
    }

    @Override
    public String toString() {
        return "Party {id:" + partyId + ", number:" + partyNumber + ", name:" + partyName + ", type:" + partyType + ", group:" + partyGroup + ", status:" + partyStatus + ", addresses:" + addresses + ", communications:" + communications + "}";
    }
}