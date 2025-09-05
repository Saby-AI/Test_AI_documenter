package model;

import java.util.ArrayList;
import java.util.List;

public class Party {
    int id;

    int partyId;
    String partyNumber;
    String partyName;
    String partyType;
    String partyGroup;
    String partyStatus;

    List<Address> addresses = new ArrayList<>();
    List<Communication> communications = new ArrayList<>();

    Party(String name, String type, String group, String status) {
        partyId = id++;
        partyNumber = genNumber(group);
        partyName = name;
        partyType = type;
        partyGroup = group;
        partyStatus = status;
    }

    String genNumber(String group) {
        return group.substring(0, 2).toUpperCase() + "_" + System.currentTimeMillis();
    }

    void addAddress(Address a) {
        addresses.add(a);
    }

    void addCommunication(Communication c) {
        communications.add(c);
    }

    public String toString() {
        return "Party {id:" + partyId + ", number:" + partyNumber + ", name:" + partyName + ", type:" + partyType + ", group:" + partyGroup + ", status:" + partyStatus + ", addresses:" + addresses + ", communications:" + communications + "}";
    }
}
