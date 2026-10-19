import java.util.Scanner;
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        System.out.print("Enter a Number : ");
        int a = sc.nextInt();
        if (a % 2 == 0) {
            if (a > 2 & a < 5) {
                System.out.println("Not Weired");
            } else if (a > 6 & a < 20) {
                System.out.println("Weired");
            } else if (a > 20) {
                System.out.println("Not Weired");
            }
        }else {
            System.out.println("The number is odd");
        }
    }
}