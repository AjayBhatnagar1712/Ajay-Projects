import java.util.Scanner;
public class array_input {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        System.out.println("Input integers in the array");
        int input = sc.nextInt();
        int[] array = new int[5];
        for (int n = 0 ; n <= 4 ; n++){
            array[n] = sc.nextInt();
        }
    }
}
