import java.util.Random;
public class RandomNumber{
    public static void main(String[] args) {
        Random rand = new Random();
        int number = rand.nextInt(3);
        System.out.print("The Random Numbers are :- " + number);
    }
}
